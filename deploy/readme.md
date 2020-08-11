## Config Files for Deployment

These files assume IMAC is already installed and located in `/opt/imac/source`.


### IMAC Frontend

Install the systemd service:
```
sudo cp imac.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start imac
sudo systemctl enable imac
```

If you want TLS, install apache and install the config (assumes Ubuntu 18.04):
```
# Place cert here: /opt/imac/tls/imac.cer
# And key here: /opt/imac/tls/imac.key

sudo apt install apache2
sudo a2enmod ssl
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo cp imac.conf /etc/apache2/sites-available
sudo a2ensite imac
```


### IMAC MongoDB Backups

Install the two systemd files:
```
sudo cp imac-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
```

This will run daily backups and store them in `/opt/imac/backups`.
