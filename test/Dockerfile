# base la plus simple et légère possible
FROM alpine:3.20.3

# installe lighttpd
# créé le groupe www
# et l'utilisateur système www
RUN apk add lighttpd \
    && addgroup www \
    && adduser -S www

# recopie le fichier de configuration
COPY ./lighttpd.conf /etc/lighttpd/lighttpd.conf

# recopie le site htdocs
COPY ./htdocs /htdocs

# démarre le serveur http
CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]


