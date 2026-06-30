FROM node:16.9.1

WORKDIR /app

COPY package.json package-lock.json /app/

RUN npm ci

COPY . /app

CMD ["npm", "run", "start"]
