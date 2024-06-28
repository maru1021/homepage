////////////////////////////////////////////////////////////////////////////////////////////////
//
// Material Selector for ObjectLuminous.fx
//    ����������I�u�W�F�N�g���A���̑f�ނ̐F�y�є����F�ŕ`�悵�܂�
//    �MMEffect�����G�t�F�N�g�������AL_EmitterRT�^�u����A
//       ���̔���������ގ��ԍ����w�肵�ă��f���ɓK�p����
//       ���邢�́A�T�u�Z�b�g�W�J���Ďw�肷��ގ��ɓK�p���܂�
//
////////////////////////////////////////////////////////////////////////////////////////////////

// ����������ގ��ԍ�
#define TargetSubset "0-1000"

//�����F (RGBA�e�v�f 0.0�`1.0)
float3 Emittion_Color
<
   string UIName = "Emittion Color1";
   string UIWidget = "Color";
   bool UIVisible =  true;
   float UIMin = 0.0; float UIMax = 1.0;
> = float3( 0.0, 0.0, 0.0 );

//�Q�C��
float Gain
<
   string UIName = "Gain";
   string UIWidget = "Slider";
   bool UIVisible =  true;
   float UIMin = 0.0; float UIMax = 5.0;
> = float( 1.0 );


// ����Ȃ��l�͂������牺�͂�����Ȃ��ł�
///////////////////////////////////////////////////////////////////////////////////////////////

// ���W�ϊ��s��
float4x4 ViewProjMatrix : VIEWPROJECTION;
float4x4 WorldMatrix    : WORLD;
float4x4 ViewMatrix     : VIEW;
float4x4 ProjMatrix     : PROJECTION;

//�J�����ʒu
float3 CameraPosition   : POSITION  < string Object = "Camera"; >;

// �}�e���A���F
float4   MaterialDiffuse   : DIFFUSE  < string Object = "Geometry"; >;
float3   MaterialAmbient   : AMBIENT  < string Object = "Geometry"; >;
float3   MaterialEmmisive  : EMISSIVE < string Object = "Geometry"; >;
float3   MaterialSpecular  : SPECULAR < string Object = "Geometry"; >;
float    SpecularPower     : SPECULARPOWER < string Object = "Geometry"; >;

bool use_texture;    //�e�N�X�`���̗L��
bool use_spheremap;  //�e�N�X�`���̗L��
bool spadd;    // �X�t�B�A�}�b�v���Z�����t���O


// �I�u�W�F�N�g�̃e�N�X�`��
texture ObjectTexture: MATERIALTEXTURE;
sampler ObjTexSampler = sampler_state
{
    texture = <ObjectTexture>;
    MINFILTER = LINEAR;
    MAGFILTER = LINEAR;
    MIPFILTER = LINEAR;
    ADDRESSU  = WRAP;
    ADDRESSV  = WRAP;
};

// �I�u�W�F�N�g�̃X�t�B�A�}�b�v�e�N�X�`���B
texture ObjectSphereMap : MATERIALSPHEREMAP;
sampler ObjSphareSampler = sampler_state
{
    texture = <ObjectSphereMap>;
    MINFILTER = LINEAR;
    MAGFILTER = LINEAR;
    MIPFILTER = LINEAR;
    ADDRESSU  = WRAP;
    ADDRESSV  = WRAP;
};


////////////////////////////////////////////////////////////////////////////////////////////////
//MMM�Ή�

#ifndef MIKUMIKUMOVING
    struct VS_INPUT{
        float4 Pos    : POSITION;
        float3 Normal : NORMAL;
        float2 Tex    : TEXCOORD0;
    };
    #define GETPOS (IN.Pos)
    #define GET_VPMAT(p) (ViewProjMatrix)
#else
    #define VS_INPUT  MMM_SKINNING_INPUT
    #define GETPOS MMM_SkinnedPosition(IN.Pos, IN.BlendWeight, IN.BlendIndices, IN.SdefC, IN.SdefR0, IN.SdefR1)
    #define GET_VPMAT(p) (MMM_IsDinamicProjection ? mul(ViewMatrix, MMM_DynamicFov(ProjMatrix, length(CameraPosition-p.xyz))) : ViewProjMatrix)
#endif


////////////////////////////////////////////////////////////////////////////////////////////////

struct VS_OUTPUT {
    float4 Pos   : POSITION;
    float2 Tex   : TEXCOORD0;   // �e�N�X�`��
    float2 SpTex : TEXCOORD1;   // �X�t�B�A�}�b�v�e�N�X�`�����W
    float4 VPos  : TEXCOORD2;
    float4 Color : COLOR0;      // �f�B�t���[�Y�F
};

// ���_�V�F�[�_
VS_OUTPUT VS_Selected(VS_INPUT IN)
{
    VS_OUTPUT Out = (VS_OUTPUT)0;

    // ���[���h���W�ϊ�
    float4 Pos = mul( GETPOS, WorldMatrix );

    // �J�������_�̃r���[�ˉe�ϊ�
    Out.Pos = mul( Pos, GET_VPMAT(Pos) );

    // �f�B�t���[�Y�F�{�A���r�G���g�F �v�Z
    Out.Color = MaterialDiffuse;
    Out.Color.rgb += MaterialEmmisive / 2;
    Out.Color.rgb *= 0.5;

    // �e�N�X�`�����W
    Out.Tex = IN.Tex;

    // �X�t�B�A�}�b�v�e�N�X�`�����W
    float3 Normal = normalize( mul( IN.Normal, (float3x3)WorldMatrix ) );
    float2 NormalWV = mul( Normal, (float3x3)ViewMatrix ).xy;
    Out.SpTex.x = NormalWV.x * 0.5f + 0.5f;
    Out.SpTex.y = NormalWV.y * -0.5f + 0.5f;

    return Out;
}

//�s�N�Z���V�F�[�_
float4 PS_Selected(VS_OUTPUT IN) : COLOR
{
    float4 Color = IN.Color;
    if ( use_texture ) {
        // �e�N�X�`���K�p
        Color *= tex2D( ObjTexSampler, IN.Tex );
    }
    if ( use_spheremap ) {
        // �X�t�B�A�}�b�v�K�p
        if(spadd) Color.rgb += tex2D(ObjSphareSampler,IN.SpTex).rgb;
        else      Color.rgb *= tex2D(ObjSphareSampler,IN.SpTex).rgb;
    }
    Color.rgb += Emittion_Color;
    Color.rgb *= (Gain * Color.a);

    return Color;
}

float4 PS_Black(float2 Tex : TEXCOORD1) : COLOR
{
    float alpha = MaterialDiffuse.a;
    if ( use_texture ) alpha *= tex2D( ObjTexSampler, Tex ).a;
    return float4(0.0, 0.0, 0.0, alpha);
}


////////////////////////////////////////////////////////////////////////////////////////////////
//�e�N�j�b�N

//�Z���t�V���h�E�Ȃ�
technique Tec1 < string MMDPass = "object"; string Subset = TargetSubset; >
{
    pass Single_Pass {
        AlphaBlendEnable = FALSE;
        VertexShader = compile vs_2_0 VS_Selected();
        PixelShader  = compile ps_2_0 PS_Selected();
    }
}

technique Mask < string MMDPass = "object"; >
{
    pass Single_Pass {
        AlphaBlendEnable = TRUE;
        VertexShader = compile vs_2_0 VS_Selected();
        PixelShader  = compile ps_2_0 PS_Black();
    }
}

//�Z���t�V���h�E����
technique Tec1SS < string MMDPass = "object_ss"; string Subset = TargetSubset; >
{
    pass Single_Pass {
        AlphaBlendEnable = FALSE;
        VertexShader = compile vs_2_0 VS_Selected();
        PixelShader  = compile ps_2_0 PS_Selected();
    }
}

technique MaskSS < string MMDPass = "object_ss"; >
{
    pass Single_Pass {
        AlphaBlendEnable = TRUE;
        VertexShader = compile vs_2_0 VS_Selected();
        PixelShader  = compile ps_2_0 PS_Black();
    }
}

//�e��֊s�͕`�悵�Ȃ�
technique EdgeTec < string MMDPass = "edge"; > { }
technique ShadowTec < string MMDPass = "shadow"; > { }

