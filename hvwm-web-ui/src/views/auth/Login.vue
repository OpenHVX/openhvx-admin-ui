<template>
  <LoginShell>
    <!-- titre -->
    <template #title>
      <h1>Connexion</h1>
      <p>Authentifiez-vous pour continuer</p>
    </template>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      size="medium"
      @submit.prevent="onSubmit"
    >
      <n-form-item path="email" label="Email">
        <n-input
          v-model:value="form.email"
          type="email"
          placeholder="vous@exemple.com"
          @keyup.enter="onSubmit"
        />
      </n-form-item>

      <n-form-item path="password" label="Mot de passe">
        <n-input
          v-model:value="form.password"
          type="password"
          show-password-on="mousedown"
          placeholder="••••••••"
          @keyup.enter="onSubmit"
        />
      </n-form-item>

      <div style="display: flex; align-items: center; gap: 12px">
        <n-checkbox v-model:checked="remember">Se souvenir de moi</n-checkbox>
        <div style="flex: 1"></div>
        <n-button type="primary" :loading="loading" @click="onSubmit">
          Se connecter
        </n-button>
      </div>

      <n-alert v-if="error" type="error" closable style="margin-top: 12px">
        {{ error }}
      </n-alert>
    </n-form>

    <!-- footer -->
    <template #footer>
      <span class="muted">Mot de passe oublié ? Contactez l’admin.</span>
    </template>
  </LoginShell>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import LoginShell from "@/layouts/LoginShell.vue";
import { useAuth } from "@/stores/auth";
import { useMessage, useNotification } from "naive-ui";

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const message = useMessage();
const notification = useNotification();

const formRef = ref(null);
const form = ref({ email: "", password: "" });
const remember = ref(true);
const loading = ref(false);
const error = ref(null);

const rules = {
  email: [
    { required: true, message: "Email requis", trigger: ["blur", "input"] },
    {
      validator: (_, v) => /.+@.+\..+/.test(v || ""),
      message: "Email invalide",
      trigger: ["blur", "input"],
    },
  ],
  password: [
    {
      required: true,
      message: "Mot de passe requis",
      trigger: ["blur", "input"],
    },
  ],
};

async function onSubmit() {
  error.value = null;
  await formRef.value?.validate();
  loading.value = true;
  try {
    await auth.login({
      email: form.value.email.trim(),
      password: form.value.password,
      remember: remember.value,
    });
    message.success("Bienvenue !");
    router.replace(route.query.r || "/");
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || "Erreur de connexion";
    error.value = msg;
    notification.error({ title: "Connexion échouée", content: msg });
  } finally {
    loading.value = false;
  }
}
</script>
