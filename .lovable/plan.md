# Plano: trocar o arquivo de download da extensão pelo "Rise Lovable.zip" do Drive

## O que já confirmei
- A pasta compartilhada é pública e contém um único arquivo: **Rise Lovable.zip**.
- A página do arquivo abre normalmente, mas o download direto pelo sandbox volta com **0 bytes** — o Google exige sessão autenticada para servir o conteúdo binário nesse caminho.
- Hoje o download do site usa `public/rise-lovable-extension.zip` (7,0 MB), servido pelo painel do cliente.

## Como resolver
Conectar o conector do Google Drive (sua própria conta) para eu baixar o arquivo pela API autenticada, e então substituir o pacote da extensão no site.

### Passos
1. Abrir o card de conexão do Google Drive e você autorizar a conta que tem a pasta.
2. Baixar o `Rise Lovable.zip` pela API do Drive e validar que é um ZIP válido de extensão (presença de `manifest.json`, tamanho, listagem dos arquivos).
3. Substituir `public/rise-lovable-extension.zip` por esse conteúdo, mantendo o mesmo nome de arquivo — assim nenhum link do site precisa mudar.
4. Conferir que o botão "Baixar extensão" no painel entrega o novo pacote (tamanho e conteúdo corretos).

### Alternativas se você preferir não conectar o Drive
- Enviar o arquivo direto no chat (anexo), que eu uso o upload sem depender do Drive.
- Colocar o ZIP em um link direto de download (Dropbox/MEGA com link direto, ou qualquer URL `https` que devolva o binário), que eu baixo por ali.

## Observação técnica
O ZIP fica em `public/`, servido como asset estático, e o botão do painel usa fetch + blob para baixar. Nenhuma mudança de código é necessária — apenas a troca do binário — desde que o novo pacote seja um ZIP de extensão MV3 válido.
