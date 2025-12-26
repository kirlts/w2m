# ⚡ Resumen Rápido: Configuración EC2 para W2M

**Guía rápida para tener a mano mientras configuras AWS**

---

## 🎯 Valores Exactos a Seleccionar

| Campo | Valor |
|-------|-------|
| **AMI** | Ubuntu Server 22.04 LTS (Free tier eligible) |
| **Instance Type** | **t3.small** |
| **Key Pair** | Crear nueva: `w2m-ec2-key` |
| **Security Group** | Crear nuevo: `w2m-security-group` |
| **Inbound Rules** | SSH (22) desde "My IP" |
| **Storage** | 20 GB gp3 |
| **User** | `ubuntu` (para Ubuntu) |

---

## 📝 Checklist Rápido

```
□ Paso 1: Name = "w2m-production"
□ Paso 2: AMI = Ubuntu 22.04 LTS (Free tier)
□ Paso 3: Instance type = t3.small
□ Paso 4: Key pair = Crear "w2m-ec2-key" → DESCARGAR .pem
□ Paso 5: Security Group = Crear "w2m-security-group"
           - SSH (22) desde "My IP"
□ Paso 6: Storage = 20 GB gp3
□ Paso 7: (Opcional) User data = vacío
□ Paso 8: Revisar → Launch instance
□ Paso 9: Esperar "Running" → Anotar IP pública
□ Paso 10: chmod 400 ~/.ssh/w2m-ec2-key.pem
□ Paso 11: ssh -i ~/.ssh/w2m-ec2-key.pem ubuntu@TU_IP
```

---

## 🔑 Comandos Post-Creación

```bash
# 1. Configurar permisos de la llave
chmod 400 ~/.ssh/w2m-ec2-key.pem

# 2. Conectar al EC2
ssh -i ~/.ssh/w2m-ec2-key.pem ubuntu@TU_IP_PUBLICA

# 3. Una vez conectado, ejecutar setup
curl -sSL https://raw.githubusercontent.com/TU_USUARIO/w2m/main/scripts/setup-ec2.sh | bash

# 4. O clonar y ejecutar
git clone https://github.com/TU_USUARIO/w2m.git ~/w2m
cd ~/w2m
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh

# 5. Configurar .env
cd ~/w2m
nano .env

# 6. Iniciar W2M
docker-compose up -d
docker-compose logs -f w2m
```

---

## ⚠️ Errores Comunes

| Error | Solución |
|-------|----------|
| "Permission denied" | `chmod 400 ~/.ssh/w2m-ec2-key.pem` |
| "Connection timed out" | Verificar Security Group permite SSH |
| "t3.small not available" | Cambiar Availability Zone |
| Usuario incorrecto | Ubuntu = `ubuntu`, Amazon Linux = `ec2-user` |

---

## 💰 Costos Estimados

- **t3.small (Free Tier):** Gratis los primeros 12 meses (si calificas)
- **t3.small (Post Free Tier):** ~$0.0208/hora (~$15/mes)
- **Storage (20GB):** ~$2/mes
- **Detenida:** Solo storage (~$2/mes)

---

## 📞 ¿Necesitas Ayuda?

Ver la guía completa: [GUIA-AWS-EC2.md](./GUIA-AWS-EC2.md)

