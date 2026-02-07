# Production stage with Nginx - expects pre-built artifacts
FROM nginx:alpine AS production

# Build context should be the prebuilt dist output directory:
# dist/apps/portals/discussion/entrypoints/csr
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Don't ship nginx config as a static asset
RUN rm -f /usr/share/nginx/html/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

