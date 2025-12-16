export default async (client) => {
    const currentTime = new Date().toLocaleString('cs-CZ');
    console.log(`✅ ${client.user?.tag} is online\n🕛 Time: ${currentTime}`);
};
