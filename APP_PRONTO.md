# Equilibria pronto para uso

## Iniciar

No Windows, dê dois cliques em:

```text
iniciar.bat
```

Ou rode no terminal:

```bash
npm start
```

Abra:

```text
http://127.0.0.1:5290
```

## Primeiro acesso

Você pode entrar com a conta demo:

```text
colaborador@equilibria.demo
demo123
```

Ou criar uma empresa real pela tela inicial em **Criar empresa**.

## Usar em uma empresa real

1. Crie a empresa.
2. Entre como administrador.
3. Abra **Administração**.
4. Cadastre colaboradores e gestores.
5. Cada colaborador entra com e-mail e senha.
6. O colaborador registra check-in de entrada e saída.
7. RH/Gestor acompanha equipes, relatórios e intervenções.
8. O administrador pode gerar backup em **Administração > Backup**.

## Onde ficam os dados

Os dados ficam em:

```text
data/equilibria-db.json
```

Faça backup desse arquivo se estiver usando localmente.

## Importante

Esta versão está pronta para uso local e pilotos com clientes. Para uso público na internet, siga `PRODUCAO.md`: banco PostgreSQL, hospedagem, HTTPS, e-mail transacional, pagamento e revisão LGPD.
