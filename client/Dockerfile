FROM node:24-slim as builder
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:latest
EXPOSE 5173
COPY --from=builder /app/dist /usr/share/nginx/html