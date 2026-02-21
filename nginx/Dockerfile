FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY generate_conf.sh /generate_conf.sh
RUN chmod +x /generate_conf.sh

CMD ["/generate_conf.sh"]
