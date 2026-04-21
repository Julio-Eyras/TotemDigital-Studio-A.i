cd /home/smartchannel/TotemDigital
sudo bash ./scripts/create-smart-signage-service.sh /home/smartchannel/TotemDigital
sudo systemctl daemon-reload
sudo systemctl enable --now smart-signage
systemctl status smart-signage --no-pager
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health



