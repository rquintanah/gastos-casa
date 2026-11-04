# Etapa 1: compilar Angular (Angular 22 necesita Node ^24.15)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Etapa 2: nginx sin root sirve la app y hace de proxy de /api hacia el backend
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/gastos-casa/browser /usr/share/nginx/html
EXPOSE 8080
