FROM node:14

# install some editors and other tools
RUN apt update -y && \
    apt install -y vim emacs less curl

# Rename the non-root user
RUN groupadd iml && usermod -d /home/iml -l iml node && usermod -a -G iml iml
USER iml:iml
WORKDIR /home/iml/imac

COPY --chown=iml:iml . .
RUN cd imac && \
    npm set progress=false && \
    npm install

CMD ["bash", "./imac/run.sh"]
