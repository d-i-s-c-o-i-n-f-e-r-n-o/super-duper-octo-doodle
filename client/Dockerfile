FROM node:22-alpine

WORKDIR /app

COPY client/package.json client/tsconfig.json /app/client/
RUN cd /app/client && npm install

COPY client/index.html client/vite.config.ts /app/client/
COPY client/src /app/client/src

EXPOSE 5173

CMD ["sh", "-c", "cd /app/client && npm run dev"]

