# 🚀 Guía: Configurar CI/CD para W2M

Esta guía te llevará paso a paso para configurar el despliegue automático desde GitHub a tu EC2.

---

## 📋 Prerrequisitos

- ✅ Repositorio en GitHub con código commiteado
- ✅ Instancia EC2 corriendo y accesible
- ✅ Llave SSH para conectarte al EC2

---

## 🔐 Paso 1: Obtener la IP Pública del EC2

**En AWS Console:**

1. Ve a **EC2 → Instances**
2. Selecciona tu instancia
3. Copia la **IPv4 Public IP** (ej: `52.54.190.237`)

**O desde tu terminal:**

```bash
# Si estás conectado al EC2
curl ifconfig.me

# O desde AWS CLI
aws ec2 describe-instances --query 'Reservations[*].Instances[*].PublicIpAddress' --output text
```

**Anota esta IP:** `_________________`

---

## 🔑 Paso 2: Obtener tu Llave SSH Privada

**En tu PC local:**

```bash
# Ver el contenido de tu llave
cat w2m-keys.pem
```

**Copia TODO el contenido**, incluyendo:
```
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

**⚠️ IMPORTANTE:** Esta es información sensible. No la compartas públicamente.

---

## 🎫 Paso 3: Crear Personal Access Token (PAT) para GitHub Container Registry

Necesitas un token para que GitHub Actions pueda hacer push/pull de imágenes Docker.

### 3.1 Crear el Token

1. Ve a **GitHub.com** → Tu perfil (esquina superior derecha)
2. **Settings** → **Developer settings** (al final del menú izquierdo)
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token** → **Generate new token (classic)**
5. **Note:** `W2M CI/CD - GHCR Access`
6. **Expiration:** Elige una duración (recomendado: 90 días o No expiration)
7. **Select scopes:**
   - ✅ `write:packages` (para push de imágenes)
   - ✅ `read:packages` (para pull de imágenes)
   - ✅ `delete:packages` (opcional, para limpiar imágenes viejas)
8. **Generate token**
9. **⚠️ COPIA EL TOKEN INMEDIATAMENTE** - No podrás verlo de nuevo

**Anota este token:** `_________________`

---

## 🔐 Paso 4: Configurar Secrets en GitHub

### 4.1 Ir a la Configuración de Secrets

1. Ve a tu repositorio en GitHub
2. **Settings** (pestaña superior)
3. **Secrets and variables** → **Actions** (menú izquierdo)
4. **New repository secret**

### 4.2 Secret 1: `EC2_HOST`

1. **Name:** `EC2_HOST`
2. **Secret:** Tu IP pública del EC2 (ej: `52.54.190.237`)
3. **Add secret**

### 4.3 Secret 2: `EC2_USER`

1. **Name:** `EC2_USER`
2. **Secret:** `ubuntu` (si usas Ubuntu) o `ec2-user` (si usas Amazon Linux)
3. **Add secret**

### 4.4 Secret 3: `EC2_SSH_KEY`

1. **Name:** `EC2_SSH_KEY`
2. **Secret:** Pega TODO el contenido de tu `w2m-keys.pem` (incluyendo las líneas `-----BEGIN` y `-----END`)
3. **Add secret**

### 4.5 Secret 4: `CR_PAT`

1. **Name:** `CR_PAT`
2. **Secret:** El Personal Access Token que creaste en el Paso 3
3. **Add secret**

---

## ✅ Verificación de Secrets

Deberías tener **4 secrets** configurados:

| Secret | Valor Ejemplo | Estado |
|--------|--------------|--------|
| `EC2_HOST` | `52.54.190.237` | ✅ |
| `EC2_USER` | `ubuntu` | ✅ |
| `EC2_SSH_KEY` | `-----BEGIN RSA...` | ✅ |
| `CR_PAT` | `ghp_xxxxxxxxxxxx` | ✅ |

---

## 🔧 Paso 5: Actualizar el Workflow (si es necesario)

Verifica que el workflow tenga el nombre correcto de tu repositorio. Revisa el archivo:

```bash
cat .github/workflows/deploy.yml
```

Busca esta línea y verifica que el formato sea correcto:

```yaml
image: ghcr.io/${GITHUB_REPOSITORY:-tu-usuario/w2m}:latest
```

El `${GITHUB_REPOSITORY}` se reemplaza automáticamente con tu usuario/repo.

---

## 🐳 Paso 6: Configurar Docker en el EC2 para GitHub Container Registry

**Conéctate al EC2:**

```bash
ssh -i w2m-keys.pem ubuntu@TU_IP_PUBLICA
```

**Crear credenciales de Docker para GHCR:**

```bash
# Crear directorio para config de Docker
mkdir -p ~/.docker

# Crear archivo de credenciales
cat > ~/.docker/config.json << EOF
{
  "auths": {
    "ghcr.io": {
      "auth": "$(echo -n 'TU_USUARIO_GITHUB:TU_CR_PAT' | base64)"
    }
  }
}
EOF

# Reemplaza:
# - TU_USUARIO_GITHUB: tu usuario de GitHub
# - TU_CR_PAT: el Personal Access Token que creaste

# Dar permisos correctos
chmod 600 ~/.docker/config.json
```

**Ejemplo:**

Si tu usuario es `kirlts` y tu token es `ghp_abc123xyz`:

```bash
echo -n 'kirlts:ghp_abc123xyz' | base64
# Esto generará algo como: a2lybHRzOmdocF9hYmMxMjN4eXo=
```

Luego:

```bash
cat > ~/.docker/config.json << EOF
{
  "auths": {
    "ghcr.io": {
      "auth": "a2lybHRzOmdocF9hYmMxMjN4eXo="
    }
  }
}
EOF
chmod 600 ~/.docker/config.json
```

**Verificar login:**

```bash
echo TU_CR_PAT | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
```

Deberías ver: `Login Succeeded`

---

## 📝 Paso 7: Actualizar docker-compose.yml en el EC2

**En el EC2, edita docker-compose.yml:**

```bash
cd ~/w2m
nano docker-compose.yml
```

**Cambia esta línea:**

```yaml
services:
  w2m:
    build:
      context: .
      target: production
```

**Por:**

```yaml
services:
  w2m:
    image: ghcr.io/TU_USUARIO/w2m:latest
    # build:  # Comentar o eliminar la sección build
    #   context: .
    #   target: production
```

**Reemplaza `TU_USUARIO` con tu usuario de GitHub.**

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

---

## 🚀 Paso 8: Hacer Push y Probar el CI/CD

**En tu PC local:**

```bash
# Asegúrate de estar en la rama main
git checkout main

# Hacer un cambio pequeño (ej: actualizar README)
echo "# Test CI/CD" >> README.md

# Commit y push
git add README.md
git commit -m "test: trigger CI/CD pipeline"
git push origin main
```

---

## 👀 Paso 9: Monitorear el Pipeline

**En GitHub:**

1. Ve a tu repositorio
2. Pestaña **Actions** (arriba)
3. Deberías ver un workflow ejecutándose: **"Build and Deploy W2M"**
4. Haz clic para ver los detalles

**Verás 3 jobs:**

1. ✅ **Test** - Ejecuta tests, lint, typecheck
2. ✅ **Build & Push** - Construye imagen Docker y la sube a GHCR
3. ✅ **Deploy** - Se conecta al EC2 y actualiza el contenedor

---

## 🔍 Paso 10: Verificar Despliegue en EC2

**Conéctate al EC2:**

```bash
ssh -i w2m-keys.pem ubuntu@TU_IP_PUBLICA
cd ~/w2m
docker-compose ps
docker-compose logs --tail=20 w2m
```

**Deberías ver:**
- ✅ Contenedor corriendo con la nueva imagen
- ✅ Logs actualizados

---

## 🆘 Troubleshooting

### ❌ Error: "Permission denied (publickey)"

**Causa:** La llave SSH en el secret está mal formateada.

**Solución:**
1. Verifica que incluyas las líneas `-----BEGIN` y `-----END`
2. Verifica que no haya espacios extra al inicio/final
3. Copia la llave completa desde tu archivo `.pem`

### ❌ Error: "Cannot connect to Docker daemon"

**Causa:** El usuario en el EC2 no tiene permisos de Docker.

**Solución:**
```bash
# En el EC2
sudo usermod -aG docker ubuntu
# Salir y reconectar
exit
ssh -i w2m-keys.pem ubuntu@TU_IP_PUBLICA
```

### ❌ Error: "unauthorized: authentication required" (GHCR)

**Causa:** El CR_PAT es incorrecto o expiró.

**Solución:**
1. Verifica que el token tenga los scopes correctos
2. Crea un nuevo token si expiró
3. Actualiza el secret `CR_PAT`

### ❌ Error: "Connection timed out" (SSH)

**Causa:** El Security Group no permite conexiones desde GitHub Actions.

**Solución:**
1. Ve a **EC2 → Security Groups**
2. Selecciona tu security group
3. **Inbound rules → Edit inbound rules**
4. Añade regla SSH desde `0.0.0.0/0` (⚠️ Menos seguro pero necesario para CI/CD)
   - O mejor: Usa una IP específica de GitHub Actions (más complejo)

### ❌ El workflow no se ejecuta

**Causa:** El archivo no está en la rama correcta o tiene errores de sintaxis.

**Solución:**
1. Verifica que `.github/workflows/deploy.yml` esté en la rama `main`
2. Verifica la sintaxis YAML (puedes usar un validador online)
3. Verifica que el trigger sea `push: branches: [main]`

---

## ✅ Checklist Final

- [ ] Secrets configurados en GitHub (4 secrets)
- [ ] Personal Access Token creado con scopes correctos
- [ ] Docker configurado en EC2 para GHCR
- [ ] docker-compose.yml actualizado para usar imagen de GHCR
- [ ] Push a main realizado
- [ ] Pipeline ejecutándose en GitHub Actions
- [ ] Despliegue exitoso en EC2

---

## 📚 Recursos Adicionales

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

**¡Listo! Tu CI/CD está configurado.** 🎉

Cada vez que hagas `git push origin main`, el código se desplegará automáticamente en tu EC2.

---

*Última actualización: Diciembre 2025*

