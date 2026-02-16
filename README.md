# Agent Arcade

Agent Arcade is the quickest staging ground for all your agentic experiments!

Whether you want to simulate a conversation between two agents, create an agent you can chat with or even test your own autonomous Moltbook agent - Agent Arcade makes setting it up quicker than heating pot noodles:

1. Create a prompt for your agent - who are they?
2. Select the tools you want to give them access to - what can they do?
3. Begin the game!

---

## Examples

<table>
<tr>
<td align="center" width="47.5%">

### Canada v USA Olympic Hockey
<video src="videos/hockey-arcade-editedv2.mp4" controls width="100%"></video>

</td>
<td align="center" width="5%">
</td>
<td align="center" width="47.5%">

### Moltbook Agent
<video src="videos/moltbook-arcade-editedv2.mp4" controls width="100%"></video>

</td>
</tr>
</table>

---

## Setting up and running Agent Arcade

### 1. Clone the repository

```bash
npm install
```

### 2. Set environment variables

Go to `localhost:3000` and select the settings button on the top right corner to add environment variables.

#### Required

- Add an openrouter api key (free to setup):  
  https://openrouter.ai/docs/api/api-reference/api-keys/create-keys
- Choose a default model.

#### Suggestions

- `anthropic/claude-haiku-4.5` is a good balance of response quality and cost.
- `arcee-ai/trinity-large-preview:free` is a fairly good prototyping option for free experimentation.

#### Optional

- Brave Search API key (free) is required for equipping an agent with internet search:  
  https://brave.com/search/api/
- If you want an agent to retain memory, add a path to a scratchpad file it can read from and write to (make sure you add instructions in the prompt explaining what it's for).
- If you would like to give your agent its own email address, set it up with a gmail account and app password:  
  https://myaccount.google.com/apppasswords

---

### 3. Create a new game

#### Turn order

Which agent goes next?

- **Orchestrated (recommended)**: An orchestrator agent decides  
- **Round robin**: Each agent takes turns  
- **Manual**: You select who goes next  

#### Memory strategy

How is conversation memory managed?

- **Summarization (recommended)**: A summary of the conversation is passed once a certain token threshold is hit  
- **Sliding window**: A certain number of previous messages are passed as context  

#### Add players

Create your agents.

**Character**  
The persona of your agents.  
Who are they? How should they behave. What should they care about? You are defining their essence. The more detailed and consistent the more predictable (or not) their behavior.

**Power-ups**  
What can they do?  
Without powerups, they can chat. But when you want them to do more like search the web, access your browser or even access Moltbook, you can enable powerups that give them superpowers.

---

### 4. Start the game!

Let the players free to be themselves. May the best player win!

---

## Additional settings

- **Loop**: The agents just keep going till you stop them  
- **Slow**: Agents take a beat before responding to give you time to catch up with what's happening  