document.getElementById('copyButton')?.addEventListener('click', async function() {
    const copyText = document.getElementById('shortUrl');
    try {
        await navigator.clipboard.writeText(copyText.value);
        // Show a confirmation message
        const confirmation = document.getElementById('copyConfirmation');
        confirmation.style.display = 'block';
        setTimeout(() => { confirmation.style.display = 'none'; }, 2000); // Hide after 2 seconds
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
});