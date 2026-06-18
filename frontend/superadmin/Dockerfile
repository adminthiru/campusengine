# Super Admin SPA — build with Vite, then serve the static bundle on $PORT.
# Railway uses this automatically because the service's Root Directory is
# `frontend/superadmin`.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev
COPY . .
# API base for production (set VITE_API_URL on the Railway service to the
# campusengine public URL + /api). Falls back to /api (dev proxy) if unset.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# ---- serve ----
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
# -s = SPA history fallback (required for React Router); Railway injects PORT.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
