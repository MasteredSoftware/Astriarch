import { Button, Box, Dialog, DialogTrigger, DialogContent } from 'astriarch-ui';
export default function Index() {
  return (
    <div>
      <Button onClick={() => console.log('clicked')}>Click me</Button>

      <Box
        css={{
          backgroundColor: '$turq',
          color: '$black',
          fontSize: '$5',
          padding: '$4',
        }}
      >
        Box
      </Box>
      <Box as="h1" css={{ color: '$turq' }}>
        Box as h1
      </Box>
      <Box css={{ display: 'flex', gap: '$3' }}>
        <Button color="turq">My Button</Button>
        <Button color="orange">My Button</Button>
      </Box>
      <Dialog>
        <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
        <DialogContent>
          <p>Order complete.</p>
          <p>You'll receive a confirmation email in the next few minutes.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
