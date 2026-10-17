import UI from '../ui';
export default async function Page({params}:{params:Promise<{route:string[]}>}){const {route}=await params;return <UI path={'/'+route.join('/')}/>}
