FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY styles.css ./
COPY app.js ./
COPY venda.html ./
COPY venda.css ./
COPY politica-privacidade.html ./
COPY termos-uso.html ./
COPY legal.css ./
COPY Equilibria-apresentacao-comercial.pdf ./
COPY README.md ./
COPY PROPOSTA_COMERCIAL.md ./
COPY ROADMAP.md ./
COPY PRODUCAO.md ./

RUN mkdir -p data

ENV PORT=5290
ENV HOST=0.0.0.0
EXPOSE 5290

CMD ["node", "server.js"]
