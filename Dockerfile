# Multi-stage build for the School Management SaaS.
# Stage 1 builds the React frontend; stage 2 is the Node API that also serves
# the built frontend from ../frontend/dist (see backend/server.js).

# ---- Stage 1: build the React frontend ----
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --include=dev
COPY frontend/ ./
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# ---- Stage 2: backend runtime ----
FROM node:20-slim AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev
COPY backend/ ./
# Bring in the built SPA so Express can serve it (path.join(__dirname, '../frontend/dist'))
COPY --from=frontend /app/frontend/dist /app/frontend/dist
ENV NODE_ENV=production
# Railway provides PORT at runtime; server.js reads process.env.PORT.
CMD ["node", "server.js"]
