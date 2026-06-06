FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/tsconfig.json /app/server/
RUN cd /app/server && npm install

COPY server/src /app/server/src
COPY db /app/db

EXPOSE 4000

CMD ["sh", "-c", "cd /app/server && npm run dev"]

