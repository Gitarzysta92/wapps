# Production stage with Nginx - expects pre-built artifacts
FROM nginx:alpine AS production

# Copy pre-built application to nginx
COPY dist/apps/portals/management-portal/entrypoints/csr /usr/share/nginx/html

# Copy nginx configuration
COPY apps/portals/management-portal/entrypoints/csr/nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

