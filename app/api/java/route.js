import axios from 'axios';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');

    // Handle the OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept',
            },
        });
    }

    try {
        // Fetch data from Maven Central
        const response = await axios.get(`https://search.maven.org/solrsearch/select`, {
            params: {
                q: `g:${groupId}`,
                wt: 'json',
            },
        });
        console.log(response)
        // Send the response back with CORS headers
        return new Response(response.data, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Credentials': 'true',
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        return new Response(JSON.stringify({ error: 'Error fetching data' }), {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Credentials': 'true',
                'Content-Type': 'application/json',
            },
        });
    }
}
