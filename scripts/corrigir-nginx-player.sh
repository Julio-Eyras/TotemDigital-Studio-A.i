#!/bin/bash
echo "A página HTML /player (player-web) foi retirada. Nginx devolve 410 em /player." >&2
echo "Players de campo usam /api/player/* (Player-AD, Player-Linux, WOS, Tizen)." >&2
exit 0
