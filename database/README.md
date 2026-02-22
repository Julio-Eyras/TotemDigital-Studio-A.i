Schema, migrations e política de instalação
==========================================

1) Fonte da verdade
- Os arquivos definitivos do schema estão em:
  - database/smartchannel-db-v2-refactored-part*.sql
  - database/smartchannel-db-v2-refactored-apply-all.sql (consolidado)

2) Migrations
- Não usamos migrations DDL em runtime. Migrations históricas foram arquivadas em:
  - database/archived-migrations/
- Migrations de dados que devem rodar durante instalação ficam em:
  - database/data-migrations/

3) Instalador
- scripts/install-smartsignage.sh chama database/apply-schema-v2.sh, que aplica os arquivos part*.sql e os seeds.
- O instalador também executa automaticamente os SQLs em database/data-migrations/ após os seeds.

4) Política
- Alterações de schema/seeds devem ser feitas diretamente nos arquivos part*.sql e nos seeds.
- Migrations DDL não são aceitas; apenas data-migrations para transformação de dados legados (colocadas em database/data-migrations/).
- Arquivos em database/archived-migrations/ são histórico e não participam do processo de instalação.

5) Como contribuir
- Ao alterar schema: atualize o arquivo part*.sql correspondente, atualize seeds se necessário, e garanta que scripts/install-smartsignage.sh e database/apply-schema-v2.sh suportem a mudança.

