FROM node:12

ENV CMD_PATH /home/node/cmd
ENV PORT 5000

RUN mkdir -p ${CMD_PATH}
WORKDIR ${CMD_PATH}

COPY package.json ${CMD_PATH}
RUN npm install
COPY . ${CMD_PATH}

EXPOSE ${PORT}

CMD npm start
