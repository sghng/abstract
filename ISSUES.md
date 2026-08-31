# Issues

A quick issue tracker.

- [ ] Orchestrator doesn't load the `journal-review` skill to parse and analyze
      the reviews for conference. Need to reframe the skill body and description
      so that it works for all kinds of reviews for journals/conference
      papers/conference posters. This skill also contains a lengthy description
      of the academic publication process. We might need to extract that out
      into some other reference document.
- [ ] Custom subagent solution (especially for exploration tasks). And instruct
      the agents on where to use it.
- [ ] Confusion around definition of ticket. For example, orchestrator cues the
      librarian to look up some docs, librarian realizes that some docs need to
      be verified and cues the orchestrator back. When in reality, this is
      something librarian should be working with user directly.
- [ ] Engineer accepted ticket specification without any back and forth with
      orchestrator.
- [ ] Agent is confused by the orchestrator vs user. Need to set clear
      instructions for who's user, who's orchestrator, who's talking, when to
      reply to whom and how.
- [ ] Dedicated subagents
  - [ ] Finding missing paper and adding them.
  - [ ] Verifying claim(s) against paper(s)
- [ ] It's rare that one research project will use hundreds of references. At
      most 50, and not all of them are cited. Caching them/taking notes of them
      locally might be a good strategy.
