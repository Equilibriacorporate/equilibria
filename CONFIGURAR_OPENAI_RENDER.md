# Configurar IA inteligente no Render

1. Acesse o painel do Render.
2. Abra o serviço `equilibria`.
3. Entre em **Environment**.
4. Adicione a variável:
   - `OPENAI_API_KEY` = sua chave da OpenAI
5. Confirme em **Save changes**.
6. Aguarde o redeploy.

Variáveis opcionais já preparadas:

- `OPENAI_MODEL=gpt-5.4-mini`
- `OPENAI_TIMEOUT_MS=18000`

Se a chave não estiver configurada ou se a OpenAI ficar indisponível, o app continua funcionando com a IA local de segurança.
