import { useMessage } from 'naive-ui';

export function useApi() {
  const message = useMessage();
  const guard = async (promise, onOk) => {
    try {
      const { data } = await promise;
      onOk && onOk(data);
      return data;
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Erreur';
      message.error(msg);
      throw e;
    }
  };
  return { guard };
}
