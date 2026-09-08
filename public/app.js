const $ = (selector) => document.querySelector(selector);
const PROFILE_KEY = "nixie-blog-profile-v1";

const fields = {
  theme: $("#profileTheme"), audience: $("#profileAudience"), voice: $("#profileVoice"),
  banned: $("#profileBanned"), sample: $("#profileSample")
};

function loadProfile() {
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  Object.entries(fields).forEach(([key, element]) => element.value = profile[key] || "");
  return profile;
}

function saveProfile() {
  const profile = Object.fromEntries(Object.entries(fields).map(([key, element]) => [key, element.value.trim()]));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function buildPrompt() {
  const profile = loadProfile();
  const mode = new FormData($("#writerForm")).get("mode");
  const modes = { auto: "내용을 분석해 검색형·홈피드형·홍보판매형 중 가장 적합한 방식을 선택", search: "네이버 검색 유입형", feed: "네이버 홈피드형", sales: "과장 없는 홍보·판매 전환형" };
  const value = (id) => $(id).value.trim() || "제공되지 않음";

  return `아래 자료로 네이버 블로그 원고를 작성해줘.

[작업 방식]
${modes[mode]}

[핵심 요청]
${value("#topic")}

[실제 경험]
${value("#experience")}

[확인된 정보]
${value("#facts")}

[참고 자료]
${value("#sources")}

[글쓴이 프로필]
- 블로그 주제: ${profile.theme || "미설정"}
- 주요 독자: ${profile.audience || "미설정"}
- 원하는 말투: ${profile.voice || "담백하고 자연스러운 경험담 말투"}
- 금지 표현: ${profile.banned || "알아보겠습니다, 살펴보겠습니다, 도움 되셨으면 좋겠습니다, 강력 추천"}
- 기존 글 샘플: ${profile.sample || "없음"}

[반드시 지킬 기준]
1. 먼저 글 유형과 핵심 검색 의도를 한 줄로 판단한다.
2. 제목 후보 5개, 최종 원고, 사진 배치 제안, 이미지 제작 프롬프트 3개, 해시태그 10개 순서로 출력한다.
3. 소제목은 짧은 명사형으로 쓰고 각 문단은 모바일에서 읽기 편하게 짧게 나눈다.
4. AI식 상투어, 같은 의미의 반복, 억지 감탄사, 과도한 광고 표현을 쓰지 않는다.
5. 사용자가 제공하지 않은 체험, 고객 반응, 가격, 효능, 수치, 공식 발언을 만들어내지 않는다.
6. 정보가 없으면 자연스럽게 생략한다. 발행에 꼭 필요하면 원고 밖의 '발행 전 확인'에만 표시한다.
7. 홍보형이라도 독자가 판단할 수 있도록 특징, 보관·이용법, 주의점, 추천 대상을 균형 있게 쓴다.
8. 제휴·협찬 정보가 있다면 표시 문구를 포함한다. 제공되지 않았다면 협찬이라고 추정하지 않는다.
9. 기존 글 샘플이 있으면 문장 길이와 어미만 참고하고 내용을 복제하지 않는다.
10. 이미지 프롬프트는 대표 이미지 1개와 본문 보조 이미지 2개로 작성한다. 실제 상품 사진이 필요한 위치는 반드시 '직접 촬영 필요'라고 쓴다.
11. AI 이미지에는 글자, 로고, 상표, 워터마크를 만들지 않는다.
12. 결과만 한국어로 작성한다.`;
}

function buildImagePrompt() {
  const topic = $("#topic").value.trim() || "블로그 주제";
  return `${topic}와 관련된 블로그 본문용 보조 사진. 일반 사용자가 스마트폰 기본 카메라로 직접 촬영한 생활 기록사진처럼 자연스럽게. 창가의 부드러운 자연광, 과보정 없는 차분한 색감, 자연스러운 스마트폰 HDR, 현실적인 질감과 약간 즉흥적인 프레이밍. 생활감 있는 소품을 최소한으로 배치. 실제 판매 상품의 품질이나 수량을 보증하는 상품 사진이 아니라 활용 장면을 보여주는 참고 이미지. 광고 화보, 스튜디오 제품 사진, 3D 렌더, 일러스트, 비현실적인 조명, 지나치게 완벽한 구도, 글자, 로고, 상표, 워터마크 제외.`;
}

async function copy(text, message) {
  await navigator.clipboard.writeText(text);
  $("#status").textContent = message;
  setTimeout(() => $("#status").textContent = "", 2200);
}

$("#openProfile").addEventListener("click", () => { loadProfile(); $("#profileDialog").showModal(); });
$("#profileForm").addEventListener("submit", (event) => { event.preventDefault(); saveProfile(); $("#profileDialog").close(); $("#status").textContent = "글쓰기 기준을 저장했습니다."; });
$("#copyPrompt").addEventListener("click", () => copy(buildPrompt(), "프롬프트를 복사했습니다. ChatGPT에 붙여넣어 사용하세요."));
$("#copyResult").addEventListener("click", () => copy($("#result").textContent, "완성 원고를 복사했습니다."));
$("#topic").addEventListener("input", () => {
  if (!$("#imagePrompt").dataset.edited) $("#imagePrompt").value = buildImagePrompt();
});
$("#imagePrompt").addEventListener("input", () => $("#imagePrompt").dataset.edited = "true");
$("#copyImagePrompt").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#imagePrompt").value || buildImagePrompt());
  $("#imageStatus").textContent = "이미지 프롬프트를 복사했습니다.";
});

$("#generateImage").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  $("#imageStatus").textContent = "이미지를 만드는 중입니다… 비용이 발생할 수 있습니다.";
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: $("#imagePrompt").value || buildImagePrompt() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    $("#generatedImage").src = data.image;
    $("#generatedImage").hidden = false;
    $("#imagePreview p").hidden = true;
    $("#downloadImage").href = data.image;
    $("#downloadImage").hidden = false;
    $("#imageStatus").textContent = "완성됐습니다. 발행할 때 AI 생성 이미지임을 표시하세요.";
  } catch (error) {
    $("#imageStatus").textContent = error.message || "이미지 생성에 실패했습니다.";
  } finally {
    button.disabled = false;
  }
});

$("#writerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("#status").textContent = "자료를 정리하고 원고를 쓰는 중입니다…";

  try {
    const response = await fetch("/api/generate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: buildPrompt() })
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === "NO_API_KEY") {
        await copy(buildPrompt(), "API 키가 없어 완성 프롬프트를 복사했습니다. ChatGPT에 붙여넣으세요.");
        return;
      }
      throw new Error(data.error);
    }
    $("#result").textContent = data.text;
    $("#resultSection").hidden = false;
    $("#resultSection").scrollIntoView({ behavior: "smooth" });
    $("#status").textContent = "초안이 완성됐습니다.";
  } catch (error) {
    $("#status").textContent = error.message || "생성 중 문제가 발생했습니다.";
  } finally {
    button.disabled = false;
  }
});

loadProfile();
$("#imagePrompt").value = buildImagePrompt();
