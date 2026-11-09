import mongoose from 'mongoose';
export async function connectDatabase(uri) {
  mongoose.set('strictQuery', 'throw');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 20, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') { await mongoose.disconnect(); throw new Error('A MongoDB replica set or sharded cluster is required for transactions.'); }
}
export const transaction = callback => mongoose.connection.transaction(callback);
