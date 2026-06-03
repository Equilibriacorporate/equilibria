# Configurar administradora real da plataforma

No Render, abra o serviço Equilibria e entre em **Environment**.

Adicione ou edite estas variáveis:

```text
PLATFORM_ADMIN_NAME=INGRID
PLATFORM_ADMIN_EMAIL=seuemail@empresa.com
PLATFORM_ADMIN_PASSWORD=sua senha forte
```

Depois clique em **Save, rebuild and deploy**.

Quando o deploy ficar **Live**, entre no app com o e-mail e a senha configurados acima.

Esse login libera para INGRID o painel de dona da plataforma, todas as áreas e todos os recursos, sem depender da conta demo.
