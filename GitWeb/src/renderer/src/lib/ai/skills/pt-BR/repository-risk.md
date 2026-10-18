# Skill: análise de risco do repositório (pelo histórico)

Use quando o usuário perguntar sobre riscos do repositório, hotspots, bus factor, saúde do projeto, ou quiser uma visão geral de um repositório desconhecido antes de uma mudança grande. Somente leitura — nada aqui altera o repositório.

1. `list_commits` com `limit: 100` (o máximo). Cada linha é `hash  data  autor  resumo`.
2. Nessa lista, conte:
   - **Autores:** commits por autor. Uma pessoa com mais de ~60% = risco de concentração de conhecimento. Conte os bots (dependabot etc.) à parte e mencione-os.
   - **Ritmo:** commits por mês. Aponte queda de 50% ou mais, ou declínio constante.
   - **Apagar incêndio:** mensagens com revert, reverte, hotfix, rollback ou emergência. Cerca de um a cada duas semanas ou mais = releases instáveis.
   - **Correções:** mensagens com corrige, corrigido, conserta, fix, bug ou broken.
3. Hotspots (opcional): `read_commit` com `include_diff: "false"` em até 10 dos commits de correção mais recentes, uma chamada por resposta. Arquivos que aparecem em várias correções são hotspots.
4. Relate em seções curtas: Autores · Ritmo · Incêndios · Hotspots (se o passo 3 rodou) · Confiança e ressalvas.
5. Sempre inclua as ressalvas: só os últimos 100 commits da branch atual foram lidos; squash merge distorce a autoria; mensagens de commit bagunçadas enfraquecem a detecção de correções. Contagens aproximadas servem — diga que são aproximadas. Não transforme sinais fracos em conclusões fortes.
