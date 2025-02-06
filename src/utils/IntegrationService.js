export class IntegrationService {
  constructor() {
    this.notionToken = null;
    this.trelloKey = null;
    this.trelloToken = null;
  }

  async initializeNotion(token) {
    this.notionToken = token;
  }

  async initializeTrello(key, token) {
    this.trelloKey = key;
    this.trelloToken = token;
  }

  async saveToNotion(tab) {
    if (!this.notionToken) return;

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: 'your-database-id' },
        properties: {
          Name: {
            title: [{ text: { content: tab.title } }]
          },
          URL: {
            url: tab.url
          }
        }
      })
    });

    return response.ok;
  }

  async saveToTrello(tab) {
    if (!this.trelloKey || !this.trelloToken) return;

    const response = await fetch(
      `https://api.trello.com/1/cards?key=${this.trelloKey}&token=${this.trelloToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tab.title,
        desc: tab.url,
        idList: 'your-list-id'
      })
    });

    return response.ok;
  }
} 