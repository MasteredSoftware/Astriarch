#!/bin/bash
set -e

mongosh --eval "
db = db.getSiblingDB('astriarch_v2');

db.createUser({
  user: 'astriarch',
  pwd: 'astriarch_password',
  roles: [
    {
      role: 'readWrite',
      db: 'astriarch_v2'
    }
  ]
});

db.createCollection('games');
db.createCollection('sessions');
db.createCollection('chatmessages');

// Create indexes for better performance
db.games.createIndex({ 'createdAt': 1 });
db.games.createIndex({ 'status': 1 });
db.sessions.createIndex({ 'sessionId': 1 }, { unique: true });
db.sessions.createIndex({ 'gameId': 1 });
db.chatmessages.createIndex({ 'gameId': 1, 'timestamp': 1 });

print('Database initialization completed successfully');
"
