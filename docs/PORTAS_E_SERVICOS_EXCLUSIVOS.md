# Portas e serviços – uso exclusivo

As portas e serviços abaixo são de **uso exclusivo** desta aplicação (SmartSignage Pro) no servidor de instalação.

| Porta | Serviço        | Uso                                      |
|-------|----------------|------------------------------------------|
| 80    | Nginx          | HTTP (frontend + proxy /api para backend) |
| 3000  | Backend Node   | API REST (acessível via Nginx ou localhost) |
| 5432  | PostgreSQL     | Banco de dados                           |
| 6379  | Redis          | Cache/sessões                            |

- O instalador e o script `scripts/fix-nginx-and-port80.sh` assumem que **nenhum outro serviço** usa a porta 80; o Nginx é configurado como único servidor HTTP (default_server).
- PostgreSQL e Redis são instalados/configurados para esta aplicação.
- Em modo produção, o backend escuta em 127.0.0.1:3000; o acesso externo é apenas via Nginx (porta 80).

Se precisar de coexistência com outros sites no mesmo servidor, será necessário ajustar manualmente a configuração do Nginx (virtual hosts) e eventualmente portas do backend.
