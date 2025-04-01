const { MongoClient, ObjectId } = require('mongodb');

// const mongoURI = 'mongodb://aescsee:B1Bom8Bi2kn0zkvP@aescwts-shard-00-00.kjck3.mongodb.net:27017,aescwts-shard-00-01.kjck3.mongodb.net:27017,aescwts-shard-00-02.kjck3.mongodb.net:27017/?replicaSet=atlas-z9g95o-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=aescWts';

// async function connectToDB() {
//   try {
//     const client = await MongoClient.connect('mongodb://aescsee:B1Bom8Bi2kn0zkvP@aescwts-shard-00-00.kjck3.mongodb.net:27017,aescwts-shard-00-01.kjck3.mongodb.net:27017,aescwts-shard-00-02.kjck3.mongodb.net:27017/?replicaSet=atlas-z9g95o-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=aescWts');
//     console.log('connected to MongoDB');
//     return client;
//   } catch (error) {
//     console.error('db.js connectToDB MongoDB 連接錯誤 :', error);
//     throw error;
//   }
// }

async function connectToDB() {
  try {
    // 使用完整的連接字串，而不是截斷的版本
    const mongoURI = process.env.MONGODB_URI || 
      'mongodb://aescsee:B1Bom8Bi2kn0zkvP@aescwts-shard-00-00.kjck3.mongodb.net:27017,aescwts-shard-00-01.kjck3.mongodb.net:27017,aescwts-shard-00-02.kjck3.mongodb.net:27017/?replicaSet=atlas-z9g95o-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=aescWts';
    
    const client = new MongoClient(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      ssl: true,
      tls: true

    });
    
    console.log('成功連接到 MongoDB Atlas');
    return client;
  } catch (error) {
    console.error('db.js connectToDB MongoDB 連接錯誤:', error);
    throw error;
  }
}

module.exports = { connectToDB, ObjectId };
