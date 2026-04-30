FROM node:20.14.0-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV NODE_OPTIONS=--max-old-space-size=256

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/uploads && chmod -R 775 /app/uploads

EXPOSE 4000

HEALTHCHECK --interval=180s --timeout=30s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http');const req=http.request({host:'127.0.0.1',port:process.env.PORT||4000,path:'/health',timeout:5000},(res)=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.end();"

CMD ["npm", "start"]
