import fetch from 'node:fetch';

const args = process.argv.slice(2);
const body = JSON.parse(args[0] || '{}');

const response = await fetch(`${process.env.WIZARR_BASE_URL}/invitations`, {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.WIZARR_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

console.log(await response.json());
