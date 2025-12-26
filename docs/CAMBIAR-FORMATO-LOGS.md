# 🔧 Cambiar Formato de Logs para Ver QR

Los logs están en formato JSON por defecto, lo que hace difícil ver el QR code. Para ver el QR correctamente, cambia el formato a "pretty".

## En el EC2:

```bash
ssh -i w2m-keys.pem ubuntu@TU_IP_PUBLICA
cd ~/w2m
nano .env
```

**Cambia esta línea:**
```bash
LOG_FORMAT=json
```

**Por:**
```bash
LOG_FORMAT=pretty
```

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

**Reiniciar el contenedor:**
```bash
docker-compose restart
docker-compose logs -f w2m
```

Ahora deberías ver el QR code claramente en los logs.

