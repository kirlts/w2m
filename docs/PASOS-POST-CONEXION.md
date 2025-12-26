# 🚀 Pasos Siguientes: Configurar W2M en EC2

Ya te conectaste exitosamente. Ahora vamos a configurar W2M.

---

## 📋 Paso 1: Conectarte de Nuevo al EC2

```bash
ssh -i w2m-keys.pem ubuntu@52.54.190.237
```

---

## 🔧 Paso 2: Ejecutar el Script de Setup

El script instalará Docker, Docker Compose, configurará swap, etc.

### Opción A: Si tu repo está en GitHub

```bash
# Descargar y ejecutar el script directamente
curl -sSL https://raw.githubusercontent.com/TU_USUARIO/w2m/main/scripts/setup-ec2.sh | bash
```

**⚠️ Reemplaza `TU_USUARIO` con tu usuario de GitHub**

### Opción B: Si tu repo NO está en GitHub (recomendado ahora)

**Desde tu PC local**, copia el script al EC2:

```bash
# En tu PC (desde el directorio w2m)
scp -i w2m-keys.pem scripts/setup-ec2.sh ubuntu@52.54.190.237:~/
```

**Luego en el EC2:**

```bash
chmod +x ~/setup-ec2.sh
~/setup-ec2.sh
```

---

## ⚠️ Paso 3: Cerrar Sesión y Reconectar

Después del setup, necesitas cerrar sesión y volver a entrar para que el grupo `docker` tome efecto:

```bash
exit
```

**Luego reconecta:**

```bash
ssh -i w2m-keys.pem ubuntu@52.54.190.237
```

---

## 📦 Paso 4: Copiar el Proyecto W2M al EC2

### Opción A: Si está en GitHub

```bash
cd ~
git clone https://github.com/TU_USUARIO/w2m.git
cd w2m
```

### Opción B: Si NO está en GitHub (recomendado ahora)

**Desde tu PC local**, copia todo el proyecto:

```bash
# En tu PC (desde el directorio padre de w2m)
scp -i w2m-keys.pem -r w2m ubuntu@52.54.190.237:~/
```

**Luego en el EC2:**

```bash
cd ~/w2m
```

---

## ⚙️ Paso 5: Configurar Variables de Entorno

```bash
cd ~/w2m

# Copiar el archivo de ejemplo
cp env.example .env

# Editar con nano
nano .env
```

**Configura estos valores mínimos:**

```bash
# WhatsApp
WA_SESSION_PATH=./data/session
WA_ALLOWED_GROUPS=    # Dejar vacío por ahora

# Vault
VAULT_PATH=./data/vault

# Git Sync (si vas a usar Git)
GIT_ENABLED=true
GIT_REMOTE=origin
GIT_BRANCH=main

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

---

## 🐳 Paso 6: Construir e Iniciar W2M

```bash
cd ~/w2m

# Construir la imagen Docker
docker-compose build

# Iniciar W2M
docker-compose up -d

# Ver logs (para escanear QR)
docker-compose logs -f w2m
```

**Verás un código QR en los logs.** Escanéalo con WhatsApp desde tu teléfono.

---

## ✅ Paso 7: Verificar que Está Funcionando

En otra terminal (o presiona `Ctrl+C` para salir de los logs):

```bash
# Ver estado del contenedor
docker-compose ps

# Ver uso de recursos
docker stats w2m --no-stream

# Ver logs recientes
docker-compose logs --tail=50 w2m
```

---

## 📝 Resumen de Comandos (Copy-Paste)

```bash
# 1. Conectar
ssh -i w2m-keys.pem ubuntu@52.54.190.237

# 2. Copiar script desde tu PC (ejecutar en tu PC)
scp -i w2m-keys.pem scripts/setup-ec2.sh ubuntu@52.54.190.237:~/

# 3. En el EC2: Ejecutar setup
chmod +x ~/setup-ec2.sh
~/setup-ec2.sh

# 4. Salir y reconectar
exit
ssh -i w2m-keys.pem ubuntu@52.54.190.237

# 5. Copiar proyecto desde tu PC (ejecutar en tu PC)
scp -i w2m-keys.pem -r w2m ubuntu@52.54.190.237:~/

# 6. En el EC2: Configurar
cd ~/w2m
cp env.example .env
nano .env  # Editar y guardar

# 7. Iniciar W2M
docker-compose build
docker-compose up -d
docker-compose logs -f w2m
```

---

## 🆘 Si Algo Sale Mal

### Error: "docker: command not found"
- Asegúrate de haber cerrado sesión y reconectado después del setup

### Error: "Permission denied" al usar docker
- Ejecuta: `sudo usermod -aG docker $USER` y reconecta

### Error: "Cannot connect to Docker daemon"
- Ejecuta: `sudo systemctl start docker`

### No aparece el QR
- Verifica logs: `docker-compose logs w2m`
- Verifica que el contenedor esté corriendo: `docker-compose ps`

---

## 🎯 Siguiente Paso Después de Escanear QR

Una vez escaneado el QR, W2M estará listo para recibir mensajes. Prueba enviando:

```
AYUDA
```

O:

```
NOTA: Esta es mi primera nota desde WhatsApp
```

---

¡Listo! Sigue estos pasos y tendrás W2M funcionando en tu EC2. 🚀

