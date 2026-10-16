export function getServerSideProps() {
  return { redirect: { destination: "/desk", permanent: false } }
}

export default function DashboardRedirect() {
  return null
}
