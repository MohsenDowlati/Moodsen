FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
USER nginx
CMD ["nginx", "-g", "daemon off;"]
