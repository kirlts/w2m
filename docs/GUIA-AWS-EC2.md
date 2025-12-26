# 🚀 Guía Paso a Paso: Crear Instancia EC2 para W2M

Esta guía te llevará paso a paso para crear una instancia EC2 t3.small en AWS, optimizada para W2M.

---

## 📋 Prerrequisitos

- ✅ Cuenta de AWS (si es nueva, tienes 12 meses de Free Tier)
- ✅ Acceso a la consola de AWS
- ✅ Estar en la página de creación de instancia EC2

---

## 🎯 Paso 1: Nombre y Etiquetas

**Ubicación:** Parte superior de la página

1. En el campo **"Name"** (Nombre), escribe: `w2m-production`
2. (Opcional) Añade etiquetas:
   - Key: `Project`, Value: `W2M`
   - Key: `Environment`, Value: `Production`

**✅ Haz clic en "Next"**

---

## 🖼️ Paso 2: Seleccionar AMI (Sistema Operativo)

**Ubicación:** Sección "Application and OS Images"

### Opción Recomendada: Ubuntu Server

1. Haz clic en **"Browse more AMIs"** (si no ves Ubuntu)
2. En la pestaña **"Quick Start"**, busca **"Ubuntu"**
3. Selecciona: **"Ubuntu Server 22.04 LTS"** o **"Ubuntu Server 24.04 LTS"**
   - ✅ Debe decir **"Free tier eligible"**
   - ✅ Arquitectura: **64-bit (x86)**

**⚠️ NO selecciones:**
- ❌ Windows (cuesta dinero)
- ❌ Amazon Linux 2023 (no es Free Tier)
- ❌ Cualquier versión que no diga "Free tier eligible"

**✅ Haz clic en "Next"**

---

## 💻 Paso 3: Tipo de Instancia

**Ubicación:** Sección "Instance type"

1. Haz clic en el dropdown **"Instance type"**
2. En el buscador, escribe: `t3.small`
3. Selecciona: **t3.small**
   - ✅ Debe mostrar: **"Free tier eligible"** (si es tu primer año)
   - ✅ vCPUs: **2**
   - ✅ RAM: **2 GiB**
   - ✅ Network: **Up to 5 Gigabit**

**⚠️ Si NO ves "Free tier eligible":**
- Puede que ya hayas usado tu Free Tier
- En ese caso, t3.small cuesta ~$0.0208/hora (~$15/mes)
- Alternativa: t3.micro (1 vCPU, 1GB RAM) es gratis, pero menos recomendado

**✅ Haz clic en "Next"**

---

## 🔑 Paso 4: Par de Llaves (SSH Key)

**Ubicación:** Sección "Key pair (login)"

### Si NO tienes una llave SSH:

1. Haz clic en **"Create new key pair"**
2. **Key pair name:** `w2m-ec2-key`
3. **Key pair type:** `RSA`
4. **Private key file format:** `pem` (para OpenSSH)
5. Haz clic en **"Create key pair"**
6. ⚠️ **IMPORTANTE:** Se descargará un archivo `.pem`
   - Guárdalo en: `~/.ssh/w2m-ec2-key.pem` (Linux/Mac) o `C:\Users\TuUsuario\.ssh\w2m-ec2-key.pem` (Windows)
   - **NO lo pierdas** - es la única forma de conectarte

### Si YA tienes una llave SSH:

1. Selecciona tu llave existente del dropdown
2. O crea una nueva siguiendo los pasos de arriba

**✅ Haz clic en "Next"**

---

## 🌐 Paso 5: Configuración de Red

**Ubicación:** Sección "Network settings"

### Configuración Básica (Recomendada para empezar):

1. **VPC:** Deja el valor por defecto (algo como `vpc-xxxxx`)
2. **Subnet:** Deja el valor por defecto
3. **Auto-assign public IP:** **Enable** (debe estar habilitado)
4. **Firewall (security groups):** Selecciona **"Create security group"**

### Security Group (Firewall):

**Nombre:** `w2m-security-group`

**Descripción:** `Security group for W2M WhatsApp to Markdown`

**Reglas de Entrada (Inbound rules):**

| Tipo | Puerto | Origen | Descripción |
|------|--------|--------|-------------|
| SSH | 22 | My IP | Acceso SSH desde tu IP |
| Custom TCP | 9229 | My IP | Node.js Inspector (debugging) |

**Cómo añadir reglas:**

1. Haz clic en **"Add security group rule"**
2. Para SSH:
   - **Type:** SSH
   - **Port:** 22
   - **Source:** Selecciona **"My IP"** (o escribe `0.0.0.0/0` si quieres acceso desde cualquier IP - menos seguro)
3. Para Node.js Inspector (opcional):
   - **Type:** Custom TCP
   - **Port:** 9229
   - **Source:** My IP

**Reglas de Salida (Outbound rules):**
- Deja las reglas por defecto (todo permitido)

**✅ Haz clic en "Next"**

---

## 💾 Paso 6: Configurar Storage

**Ubicación:** Sección "Configure storage"

### Configuración Recomendada:

1. **Volume 1 (root):**
   - **Size (GiB):** `20` (mínimo para Free Tier)
   - **Volume type:** `gp3` (General Purpose SSD)
   - **Delete on termination:** ✅ **Marcado** (opcional, para no acumular costos si eliminas la instancia)

**⚠️ Importante:**
- Free Tier incluye 30GB de EBS General Purpose
- 20GB es suficiente para W2M + sistema operativo
- Si necesitas más, puedes aumentar (pero puede tener costo)

**✅ Haz clic en "Next"**

---

## ⚙️ Paso 7: Configuración Avanzada (Opcional)

**Ubicación:** Sección "Advanced details"

### Configuración Recomendada:

1. **IAM role:** Deja vacío (no necesario para W2M básico)
2. **Shutdown behavior:** `Stop` (no `Terminate`)
3. **Enable termination protection:** ✅ **Marcado** (previene eliminación accidental)
4. **User data:** (Opcional) Puedes dejar vacío o pegar esto para configuración automática:

```bash
#!/bin/bash
# Instalar Docker automáticamente al iniciar
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
```

**✅ Haz clic en "Next"**

---

## 📊 Paso 8: Revisar y Lanzar

**Ubicación:** Sección "Summary"

### Revisa que todo esté correcto:

- ✅ **AMI:** Ubuntu Server 22.04 LTS (Free tier eligible)
- ✅ **Instance type:** t3.small
- ✅ **Key pair:** Tu llave SSH (ej: `w2m-ec2-key`)
- ✅ **Network:** Security group con SSH (puerto 22)
- ✅ **Storage:** 20 GiB gp3

### ⚠️ Advertencia de Costos:

Si aparece una advertencia sobre costos:
- Si es tu primer año: t3.small puede ser gratis (depende de tu cuenta)
- Si no: ~$0.0208/hora (~$15/mes)
- Puedes detener la instancia cuando no la uses (solo pagas storage: ~$2/mes)

**✅ Haz clic en "Launch instance"**

---

## ⏳ Paso 9: Esperar a que Inicie

1. Verás una pantalla de confirmación
2. Haz clic en **"View all instances"** o ve a **EC2 → Instances**
3. Espera 1-2 minutos hasta que el estado cambie a **"Running"**
4. Anota la **IPv4 Public IP** (ej: `54.123.45.67`)

---

## 🔐 Paso 10: Configurar Permisos de la Llave SSH

**En tu PC local (Linux/Mac):**

```bash
# Mover la llave a ~/.ssh
mv ~/Downloads/w2m-ec2-key.pem ~/.ssh/

# Dar permisos correctos (IMPORTANTE)
chmod 400 ~/.ssh/w2m-ec2-key.pem
```

**En Windows (PowerShell):**

```powershell
# Mover la llave
Move-Item ~\Downloads\w2m-ec2-key.pem ~\.ssh\

# Dar permisos (ejecutar como Administrador)
icacls ~\.ssh\w2m-ec2-key.pem /inheritance:r
icacls ~\.ssh\w2m-ec2-key.pem /grant:r "$($env:USERNAME):(R)"
```

---

## 🚀 Paso 11: Conectarte por Primera Vez

**En tu PC local:**

```bash
# Reemplaza con tu IP pública y usuario
# Ubuntu usa 'ubuntu', Amazon Linux usa 'ec2-user'
ssh -i ~/.ssh/w2m-ec2-key.pem ubuntu@TU_IP_PUBLICA
```

**Ejemplo:**
```bash
ssh -i ~/.ssh/w2m-ec2-key.pem ubuntu@54.123.45.67
```

**Si es la primera vez, verás:**
```
The authenticity of host '54.123.45.67' can't be established.
Are you sure you want to continue connecting (yes/no)?
```
Escribe `yes` y presiona Enter.

---

## ✅ Paso 12: Verificar Conexión

Una vez conectado, deberías ver algo como:

```
Welcome to Ubuntu 22.04.3 LTS...
ubuntu@ip-172-31-XX-XX:~$
```

**Prueba estos comandos:**

```bash
# Verificar sistema
uname -a

# Verificar espacio
df -h

# Verificar memoria
free -h
```

---

## 🎯 Paso 13: Configurar W2M en el EC2

Ahora que estás conectado al EC2, ejecuta el script de setup:

```bash
# Opción 1: Descargar y ejecutar el script
curl -sSL https://raw.githubusercontent.com/TU_USUARIO/w2m/main/scripts/setup-ec2.sh | bash

# Opción 2: Clonar el repo y ejecutar
git clone https://github.com/TU_USUARIO/w2m.git ~/w2m
cd ~/w2m
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh
```

**El script hará:**
- ✅ Instalar Docker y Docker Compose
- ✅ Configurar Swap de 2GB
- ✅ Crear estructura de directorios
- ✅ Crear archivo `.env` de ejemplo

---

## 📝 Paso 14: Configurar Variables de Entorno

```bash
cd ~/w2m
nano .env
```

**Edita estos valores importantes:**

```bash
# WhatsApp
WA_ALLOWED_GROUPS=    # Dejar vacío por ahora, se configurará después

# Git Sync (si usas Git)
GIT_ENABLED=true
GIT_REMOTE=origin
GIT_BRANCH=main
```

Guarda con `Ctrl+O`, Enter, `Ctrl+X`.

---

## 🐳 Paso 15: Iniciar W2M por Primera Vez

```bash
cd ~/w2m

# Iniciar W2M
docker-compose up -d

# Ver logs (para escanear QR)
docker-compose logs -f w2m
```

**Verás un código QR en los logs.** Escanéalo con WhatsApp.

---

## 🔒 Paso 16: Configurar Security Group para GitHub Actions (Opcional)

Si vas a usar CI/CD, necesitas permitir SSH desde GitHub Actions:

1. Ve a **EC2 → Security Groups**
2. Selecciona `w2m-security-group`
3. **Inbound rules → Edit inbound rules**
4. Añade:
   - **Type:** SSH
   - **Port:** 22
   - **Source:** `0.0.0.0/0` (⚠️ Menos seguro, pero necesario para CI/CD)
   - O mejor: Usa una IP específica de GitHub Actions (más complejo)

**⚠️ Nota de Seguridad:**
- Para mayor seguridad, considera usar un bastion host o VPN
- O restringir a tu IP personal y usar GitHub Actions con self-hosted runner

---

## 💰 Paso 17: Monitorear Costos

**Para evitar sorpresas:**

1. Ve a **AWS Billing → Cost Management**
2. Activa **"Cost Alerts"**
3. Configura una alerta cuando gastes > $5/mes

**Para detener la instancia cuando no la uses:**

```bash
# Desde AWS Console: EC2 → Instances → Stop instance
# O desde CLI:
aws ec2 stop-instances --instance-ids i-xxxxx
```

**Costo cuando está detenida:** Solo storage (~$2/mes por 20GB)

---

## 🆘 Troubleshooting

### ❌ "Permission denied (publickey)"

**Solución:**
```bash
# Verificar permisos de la llave
chmod 400 ~/.ssh/w2m-ec2-key.pem

# Verificar que estás usando el usuario correcto
# Ubuntu: ubuntu
# Amazon Linux: ec2-user
```

### ❌ "Connection timed out"

**Solución:**
1. Verifica que el Security Group permite SSH desde tu IP
2. Verifica que la instancia está "Running"
3. Verifica la IP pública (puede cambiar si reinicias)

### ❌ "Instance type not available"

**Solución:**
- Prueba otra zona de disponibilidad (Availability Zone)
- O usa t3.micro si t3.small no está disponible

---

## 📚 Recursos Adicionales

- [Documentación EC2 Free Tier](https://aws.amazon.com/free/?all-free-tier.sort-by=item.additionalFields.SortDate&all-free-tier.sort-order=desc)
- [Guía de Seguridad EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html)
- [Documento de Diseño W2M](../docs/TDD-W2M.md)

---

## ✅ Checklist Final

- [ ] Instancia EC2 t3.small creada y corriendo
- [ ] Llave SSH descargada y con permisos correctos
- [ ] Conectado por SSH exitosamente
- [ ] Script `setup-ec2.sh` ejecutado
- [ ] Docker y Docker Compose instalados
- [ ] Archivo `.env` configurado
- [ ] W2M iniciado y QR escaneado
- [ ] Security Group configurado para CI/CD (opcional)

---

**¡Listo! Tu instancia EC2 está configurada para W2M.** 🎉

---

*Última actualización: Diciembre 2025*

