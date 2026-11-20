export class FirestoreStore {
  constructor(db) { this.db = db; }
  transaction(callback) {
    return this.db.runTransaction(async transaction => {
      const writes = [];
      const store = {
        get: async path => { const doc = await transaction.get(this.db.doc(path)); return doc.exists ? { ...doc.data(), id: doc.id } : null; },
        list: async (collection, filters = [], cap = 5000) => {
          let query = this.db.collection(collection);
          for (const [field, operator, value] of filters) query = query.where(field, operator, value);
          const snap = await transaction.get(query.limit(cap + 1));
          if (snap.size > cap) throw Object.assign(new Error('Demasiados resultados. Reduce el período o consulta un ministerio.'), { status: 422 });
          return snap.docs.map(d => ({ ...d.data(), id: d.id }));
        },
        set: (path, value, merge = false) => writes.push({ path, value, merge }),
      };
      const result = await callback(store);
      for (const w of writes) transaction.set(this.db.doc(w.path), w.value, { merge: w.merge });
      return result;
    });
  }
}
