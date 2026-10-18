# Skill: análise de risco do repositório (sinais do histórico)

Use quando o usuário perguntar sobre riscos do repositório, hotspots, bus factor, saúde do projeto, ou quiser uma visão geral de um repositório desconhecido antes de uma mudança grande. Somente leitura — nada aqui altera o repositório.

1. **Colete o histórico.** Chame `list_commits` com `limit: 100` (o máximo). Cada linha é `hash data autor resumo`.
2. **Extraia os sinais dessa lista:**
   - **Concentração / bus factor:** commits por autor. Uma pessoa acima de ~60% é risco de concentração de conhecimento. Deixe bots (dependabot etc.) fora da porcentagem, mas mencione-os.
   - **Ritmo:** commits por mês; aponte queda brusca (50% ou mais) ou declínio constante.
   - **Apagar incêndio:** mensagens com revert, reverte, hotfix, rollback ou emergência. Alguns são normais; algo como um a cada duas semanas sugere processo de release instável.
   - **Commits de correção:** mensagens com corrige, corrigido, conserta, fix, bug ou broken.
3. **Hotspots de bug (opcional, mantenha barato).** Chame `read_commit` com `include_diff: "false"` em até 10 dos commits de correção mais recentes e conte quais arquivos se repetem. Arquivos que aparecem em várias correções são hotspots.
4. **Relate** em seções curtas:
   - Concentração de autoria
   - Tendência de ritmo
   - Frequência de incêndios
   - Arquivos hotspot (se o passo 3 rodou)
   - Confiança e ressalvas
5. **Sempre inclua as ressalvas:** só os últimos 100 commits da branch atual foram analisados; squash merge distorce a autoria; mensagens de commit inconsistentes enfraquecem a detecção de correções e hotfixes. Não transforme sinais fracos em conclusões fortes.
