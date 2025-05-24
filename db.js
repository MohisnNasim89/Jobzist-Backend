const mongoose = require('mongoose');

const uri = 'process.env.MONGO_URI';

async function clearDatabase() {
  await mongoose.connect(uri);
  const collections = await mongoose.connection.db.collections();

  for (let collection of collections) {
    await collection.deleteMany({});
    console.log(`Cleared: ${collection.collectionName}`);
  }

  console.log('All collections cleared.');
  process.exit();
}

clearDatabase().catch(console.error);
