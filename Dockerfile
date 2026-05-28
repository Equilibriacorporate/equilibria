from node:22-alpine

workdir /app

copy . .

run mkdir -p data

env port=5290
env host=0.0.0.0
expose 5290

cmd ["node","server.js"]
